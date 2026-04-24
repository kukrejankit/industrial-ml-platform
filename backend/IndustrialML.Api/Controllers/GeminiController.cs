using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Json.Serialization;

[ApiController]
[Route("api/gemini")]
public class GeminiController : ControllerBase
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _cfg;

    public GeminiController(IHttpClientFactory httpFactory, IConfiguration cfg)
    {
        _httpFactory = httpFactory;
        _cfg = cfg;
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] JsonElement body)
    {
        var apiKey = _cfg["Claude:ApiKey"];
        var apiUrl = _cfg["Claude:ApiUrl"] ?? "https://api.anthropic.com/v1/messages";
        var model  = _cfg["Claude:Model"]  ?? "claude-sonnet-4-6";

        // Extract messages and system prompt from the incoming OpenAI-format request
        var messages = new List<ClaudeMessage>();
        string? systemPrompt = null;

        if (body.TryGetProperty("messages", out var msgs))
        {
            foreach (var msg in msgs.EnumerateArray())
            {
                var role    = msg.GetProperty("role").GetString();
                var content = msg.GetProperty("content").GetString() ?? "";

                if (role == "system")
                {
                    systemPrompt = content;
                }
                else
                {
                    messages.Add(new ClaudeMessage
                    {
                        Role    = role == "assistant" ? "assistant" : "user",
                        Content = content
                    });
                }
            }
        }

        // Ensure messages alternate user/assistant (Claude requirement)
        // Merge consecutive same-role messages
        var merged = new List<ClaudeMessage>();
        foreach (var m in messages)
        {
            if (merged.Count > 0 && merged[^1].Role == m.Role)
                merged[^1].Content += "\n" + m.Content;
            else
                merged.Add(m);
        }

        // Claude requires first message to be from user
        if (merged.Count == 0 || merged[0].Role != "user")
            merged.Insert(0, new ClaudeMessage { Role = "user", Content = "Hello" });

        var maxTokens = 2048;
        if (body.TryGetProperty("max_tokens", out var mt))
            maxTokens = mt.GetInt32();

        var claudeRequest = new
        {
            model,
            max_tokens = maxTokens,
            system = systemPrompt,
            messages = merged
        };

        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Add("x-api-key", apiKey);
        client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
        client.Timeout = TimeSpan.FromSeconds(30);

        HttpResponseMessage response;
        try
        {
            response = await client.PostAsJsonAsync(apiUrl, claudeRequest);
        }
        catch (TaskCanceledException)
        {
            return StatusCode(504, "Request to Claude API timed out");
        }
        var claudeJson = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            return StatusCode((int)response.StatusCode, claudeJson);

        // Parse Claude response and convert to OpenAI-compatible format
        using var doc = JsonDocument.Parse(claudeJson);
        var root = doc.RootElement;

        var text = root
            .GetProperty("content")[0]
            .GetProperty("text")
            .GetString() ?? "";

        var openAiResponse = new
        {
            choices = new[]
            {
                new { message = new { role = "assistant", content = text } }
            }
        };

        return Ok(openAiResponse);
    }
}

public class ClaudeMessage
{
    [JsonPropertyName("role")]
    public string Role { get; set; } = "";

    [JsonPropertyName("content")]
    public string Content { get; set; } = "";
}
