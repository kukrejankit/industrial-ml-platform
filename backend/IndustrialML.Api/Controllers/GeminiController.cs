using Microsoft.AspNetCore.Mvc;

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
    public async Task<IActionResult> Chat([FromBody] object body)
    {
        var apiKey = _cfg["Groq:ApiKey"];
        var apiUrl = _cfg["Groq:ApiUrl"];

        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
        var response = await client.PostAsJsonAsync(apiUrl, body);
        var content = await response.Content.ReadAsStringAsync();

        return Content(content, "application/json");
    }
}
