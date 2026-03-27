import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const words = content.trim().split(/\s+/);
    const wordCount = words.length;
    // Truncate for AI analysis
    const textForAnalysis = content.slice(0, 8000);

    // Call Lovable AI for analysis using tool calling for structured output
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
            content: `You are an advanced plagiarism and AI writing detection system. Analyze the submitted text and provide a detailed report.

For SIMILARITY analysis:
- Identify sections that appear to match common online sources, publications, or student papers
- Look for exact phrases, paraphrased content, and structural similarities
- For each flagged section, provide a realistic source URL and classify the source type
- Source types must be exactly one of: "Internet Source", "Publication", "Student Papers"
- Generate realistic but plausible source URLs from academic domains (scholar.google.com, researchgate.net, jstor.org, sciencedirect.com, springer.com, wiley.com, ncbi.nlm.nih.gov, tandfonline.com, ieee.org, arxiv.org)

For AI WRITING detection:
- Analyze writing patterns, perplexity, burstiness, and stylistic markers
- Detect sections that appear machine-generated vs human-written
- Consider sentence structure uniformity, vocabulary patterns, and transition phrases

Be realistic and nuanced. Academic writing naturally has some similarity to existing sources. Don't flag common phrases or standard academic language.`
          },
          {
            role: 'user',
            content: `Analyze this text (${wordCount} words) for plagiarism similarity and AI writing detection:\n\n${textForAnalysis}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'submit_analysis_report',
              description: 'Submit the plagiarism and AI writing analysis report',
              parameters: {
                type: 'object',
                properties: {
                  similarity_score: {
                    type: 'number',
                    description: 'Overall similarity percentage (0-100). Be realistic: most original academic papers score 5-25%.'
                  },
                  paraphrase_score: {
                    type: 'number',
                    description: 'Percentage of text that appears paraphrased from sources (0-100)'
                  },
                  ai_probability: {
                    type: 'number',
                    description: 'Probability the text was AI-generated (0-100). Consider writing patterns, perplexity, and stylistic markers.'
                  },
                  flagged_sections: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        text: { type: 'string', description: 'The exact text segment that was flagged (copy verbatim from the input, 20-200 chars)' },
                        reason: { type: 'string', description: 'Brief explanation of why this was flagged' },
                        risk: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Risk level of this match' },
                        source_url: { type: 'string', description: 'Plausible source URL where this content may originate' },
                        source_type: { type: 'string', enum: ['Internet Source', 'Publication', 'Student Papers'], description: 'Type of source' }
                      },
                      required: ['text', 'reason', 'risk', 'source_url', 'source_type']
                    },
                    description: 'List of flagged text sections with sources. Include 3-10 sections depending on document length.'
                  },
                  summary: {
                    type: 'string',
                    description: 'A 2-3 sentence summary of the analysis findings'
                  },
                  recommendations: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '3-5 specific recommendations for improving originality'
                  }
                },
                required: ['similarity_score', 'paraphrase_score', 'ai_probability', 'flagged_sections', 'summary', 'recommendations']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'submit_analysis_report' } }
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds in Settings > Workspace > Usage.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await aiResponse.text();
      console.error('AI gateway error:', status, errText);
      return new Response(JSON.stringify({ error: 'AI analysis service error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    
    // Extract structured output from tool call
    let report;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        report = JSON.parse(toolCall.function.arguments);
      } else {
        throw new Error('No structured output from AI');
      }
    } catch (parseErr) {
      console.error('Failed to parse AI response:', parseErr, JSON.stringify(aiData).slice(0, 500));
      return new Response(JSON.stringify({ error: 'Failed to parse analysis results' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clamp scores to valid ranges
    report.similarity_score = Math.max(0, Math.min(100, Math.round(report.similarity_score)));
    report.paraphrase_score = Math.max(0, Math.min(100, Math.round(report.paraphrase_score)));
    report.ai_probability = Math.max(0, Math.min(100, Math.round(report.ai_probability)));

    // Ensure flagged sections have valid source types
    const validTypes = ['Internet Source', 'Publication', 'Student Papers'];
    report.flagged_sections = (report.flagged_sections || []).map((s: any) => ({
      ...s,
      source_type: validTypes.includes(s.source_type) ? s.source_type : 'Internet Source',
    }));

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
