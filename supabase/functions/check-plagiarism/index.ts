import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Extract significant phrases from text for web searching
function extractSearchPhrases(text: string, count = 8): string[] {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 30);
  const phrases: string[] = [];
  const step = Math.max(1, Math.floor(sentences.length / count));
  
  for (let i = 0; i < sentences.length && phrases.length < count; i += step) {
    const words = sentences[i].split(/\s+/).filter(w => w.length > 3);
    if (words.length >= 4) {
      // Take a 5-8 word chunk from the middle of the sentence
      const start = Math.floor(words.length / 4);
      const chunk = words.slice(start, start + Math.min(7, words.length - start)).join(' ');
      if (chunk.length > 15) {
        phrases.push(chunk);
      }
    }
  }
  return phrases;
}

// Search for a phrase using DuckDuckGo HTML and extract real URLs
async function searchPhrase(phrase: string): Promise<{ url: string; title: string }[]> {
  try {
    const query = encodeURIComponent(`"${phrase}"`);
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!resp.ok) return [];
    const html = await resp.text();
    
    const results: { url: string; title: string }[] = [];
    // Extract URLs from DuckDuckGo HTML results
    const linkRegex = /class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null && results.length < 3) {
      let url = match[1];
      // DuckDuckGo wraps URLs in a redirect, extract the actual URL
      const udMatch = url.match(/uddg=([^&]+)/);
      if (udMatch) {
        url = decodeURIComponent(udMatch[1]);
      }
      if (url.startsWith('http')) {
        results.push({ url, title: match[2].trim() });
      }
    }
    return results;
  } catch (e) {
    console.error('Search error for phrase:', phrase, e);
    return [];
  }
}

// Use OpenAI to detect AI-written content
async function detectAIWriting(text: string, apiKey: string): Promise<{ ai_probability: number; analysis: string }> {
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert AI writing detection system. Analyze text for signs of AI generation. 
Consider: sentence structure uniformity, vocabulary patterns, perplexity, burstiness, transition phrase patterns, hedging language, and stylistic markers.
Return a JSON object with:
- "ai_probability": number 0-100 (probability text is AI-generated)
- "analysis": brief 2-sentence analysis of findings`
          },
          {
            role: 'user',
            content: `Analyze this text for AI writing patterns:\n\n${text.slice(0, 6000)}`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      console.error('OpenAI API error:', resp.status);
      return { ai_probability: 0, analysis: 'AI detection unavailable' };
    }

    const data = await resp.json();
    const result = JSON.parse(data.choices[0].message.content);
    return {
      ai_probability: Math.max(0, Math.min(100, Math.round(result.ai_probability || 0))),
      analysis: result.analysis || '',
    };
  } catch (e) {
    console.error('OpenAI detection error:', e);
    return { ai_probability: 0, analysis: 'AI detection error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    if (!anonKey) {
      return new Response(JSON.stringify({ error: 'Server config error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = data.claims.sub;

    const { content, checkId } = await req.json();

    if (!content || content.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'Content too short' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const words = content.trim().split(/\s+/);
    const wordCount = words.length;
    const textForAnalysis = content.slice(0, 8000);

    // Step 1: Extract key phrases and search the web for real matches
    console.log('Extracting search phrases...');
    const phrases = extractSearchPhrases(textForAnalysis);
    console.log(`Found ${phrases.length} phrases to search`);

    // Step 2: Search each phrase in parallel (with limit)
    const searchPromises = phrases.map(phrase => searchPhrase(phrase));
    const searchResults = await Promise.all(searchPromises);

    // Build real flagged sections from search results
    const flaggedSections: any[] = [];
    const validTypes = ['Internet Source', 'Publication', 'Student Papers'];
    
    for (let i = 0; i < phrases.length; i++) {
      const results = searchResults[i];
      if (results.length > 0) {
        const source = results[0];
        // Determine source type based on URL
        let sourceType = 'Internet Source';
        const url = source.url.toLowerCase();
        if (url.includes('scholar.google') || url.includes('jstor.org') || url.includes('researchgate.net') || 
            url.includes('sciencedirect') || url.includes('springer.com') || url.includes('wiley.com') || 
            url.includes('ncbi.nlm.nih.gov') || url.includes('arxiv.org') || url.includes('ieee.org') ||
            url.includes('tandfonline') || url.includes('doi.org') || url.includes('pubmed')) {
          sourceType = 'Publication';
        } else if (url.includes('coursehero') || url.includes('studocu') || url.includes('chegg') || 
                   url.includes('bartleby') || url.includes('academia.edu')) {
          sourceType = 'Student Papers';
        }

        flaggedSections.push({
          text: phrases[i],
          reason: `Matching content found at: ${source.title || source.url}`,
          risk: results.length >= 2 ? 'high' : 'medium',
          source_url: source.url,
          source_type: sourceType,
        });
      }
    }

    // Calculate similarity score based on real matches
    const similarityScore = Math.min(100, Math.round((flaggedSections.length / Math.max(phrases.length, 1)) * 100));
    const paraphraseScore = Math.round(similarityScore * 0.4); // estimate

    // Step 3: AI Writing Detection using OpenAI (if key available) or Lovable AI
    let aiProbability = 0;
    let aiAnalysis = '';

    if (OPENAI_API_KEY) {
      console.log('Using OpenAI for AI detection...');
      const aiResult = await detectAIWriting(textForAnalysis, OPENAI_API_KEY);
      aiProbability = aiResult.ai_probability;
      aiAnalysis = aiResult.analysis;
    } else {
      // Fallback to Lovable AI for AI detection
      console.log('Using Lovable AI for AI detection (no OpenAI key)...');
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `You are an AI writing detection system. Analyze text and return JSON with:
- "ai_probability": number 0-100
- "analysis": brief 2-sentence analysis`
            },
            {
              role: 'user',
              content: `Analyze this text for AI writing:\n\n${textForAnalysis.slice(0, 5000)}`
            }
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'submit_ai_detection',
              description: 'Submit AI detection result',
              parameters: {
                type: 'object',
                properties: {
                  ai_probability: { type: 'number' },
                  analysis: { type: 'string' },
                },
                required: ['ai_probability', 'analysis'],
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'submit_ai_detection' } },
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        try {
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            aiProbability = Math.max(0, Math.min(100, Math.round(parsed.ai_probability || 0)));
            aiAnalysis = parsed.analysis || '';
          }
        } catch (e) {
          console.error('Fallback AI detection parse error:', e);
        }
      }
    }

    // Step 4: Generate summary and recommendations using Lovable AI
    const aiSummaryResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Generate a brief summary and recommendations for a plagiarism report. Return JSON only.'
          },
          {
            role: 'user',
            content: `Similarity: ${similarityScore}%, AI probability: ${aiProbability}%, Matches found: ${flaggedSections.length}. Text length: ${wordCount} words. Generate a 2-3 sentence summary and 3-5 recommendations.`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'submit_summary',
            description: 'Submit summary and recommendations',
            parameters: {
              type: 'object',
              properties: {
                summary: { type: 'string' },
                recommendations: { type: 'array', items: { type: 'string' } },
              },
              required: ['summary', 'recommendations'],
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'submit_summary' } },
      }),
    });

    let summary = `The document has a ${similarityScore}% similarity score with ${flaggedSections.length} matching sources found online.`;
    let recommendations = ['Review flagged sections and paraphrase where needed.', 'Add proper citations for matched content.', 'Use original phrasing to reduce similarity.'];

    if (aiSummaryResp.ok) {
      try {
        const summaryData = await aiSummaryResp.json();
        const toolCall = summaryData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          summary = parsed.summary || summary;
          recommendations = parsed.recommendations || recommendations;
        }
      } catch (e) {
        console.error('Summary parse error:', e);
      }
    }

    const report = {
      similarity_score: similarityScore,
      paraphrase_score: paraphraseScore,
      ai_probability: aiProbability,
      flagged_sections: flaggedSections,
      summary,
      recommendations,
    };

    // Update the check record
    if (checkId) {
      await supabase
        .from('plagiarism_checks')
        .update({
          status: 'completed',
          similarity_score: report.similarity_score,
          paraphrase_score: report.paraphrase_score,
          match_count: report.flagged_sections.length,
          results: report,
          content: content.slice(0, 10000),
        })
        .eq('id', checkId);
    }

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
