using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Text;
using System.Text.Json;

[ApiController]
[Route("api/email")]
public class EmailController : ControllerBase
{
    private readonly IConfiguration _cfg;
    private readonly IHttpClientFactory _httpFactory;

    public EmailController(IConfiguration cfg, IHttpClientFactory httpFactory)
    {
        _cfg = cfg;
        _httpFactory = httpFactory;
    }

    [HttpPost("send-responses")]
    public async Task<IActionResult> SendResponses([FromBody] SendResponsesRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.To))
            return BadRequest("Recipient email is required.");

        var apiKey = _cfg["SendGrid:ApiKey"];
        var from   = _cfg["SendGrid:From"];

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(from))
            return StatusCode(503, "Email service is not configured.");

        var html = BuildEmailHtml(req);

        var payload = new
        {
            personalizations = new[]
            {
                new { to = new[] { new { email = req.To } } }
            },
            from    = new { email = from },
            subject = $"Form Responses: {req.FormTitle}",
            content = new[]
            {
                new { type = "text/html", value = html }
            }
        };

        var client = _httpFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

        var response = await client.PostAsync(
            "https://api.sendgrid.com/v3/mail/send",
            new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        );

        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync();
            return StatusCode((int)response.StatusCode, err);
        }

        return Ok();
    }

    private static string BuildEmailHtml(SendResponsesRequest req)
    {
        var title    = WebUtility.HtmlEncode(req.FormTitle);
        var sentAt   = DateTime.UtcNow.ToString("dd MMM yyyy, HH:mm UTC");
        var sb       = new StringBuilder();

        sb.Append($@"<html>
<body style='font-family:Arial,sans-serif;color:#1e293b;padding:0;margin:0;background:#f8fafc;'>
  <div style='max-width:680px;margin:0 auto;padding:32px 16px;'>

    <!-- Header -->
    <div style='background:linear-gradient(135deg,#1e3a5f 0%,#0f766e 100%);border-radius:12px 12px 0 0;padding:28px 32px;'>
      <div style='color:white;font-size:22px;font-weight:700;margin:0 0 6px;'>Form Responses</div>
      <div style='color:rgba(255,255,255,0.8);font-size:14px;'>{title}</div>
      <div style='color:rgba(255,255,255,0.55);font-size:12px;margin-top:6px;'>Submitted {sentAt}</div>
    </div>

    <!-- Body -->
    <div style='background:white;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;padding:8px 0 24px;'>
");

        for (int i = 0; i < req.Responses.Count; i++)
        {
            var row    = req.Responses[i];
            var bg     = i % 2 == 0 ? "#f8fafc" : "#ffffff";
            var border = i < req.Responses.Count - 1 ? "border-bottom:1px solid #e2e8f0;" : "";
            // Convert newlines to <br> for multi-sentence answers
            var answerHtml = WebUtility.HtmlEncode(row.Answer)
                .Replace("&#xA;", "<br>")
                .Replace("\n", "<br>");

            sb.Append($@"
      <div style='padding:18px 32px;background:{bg};{border}'>
        <div style='font-size:12px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;'>
          Q{i + 1} · {WebUtility.HtmlEncode(row.Question)}
        </div>
        <div style='font-size:14px;color:#1e293b;line-height:1.7;'>
          {answerHtml}
        </div>
      </div>");
        }

        sb.Append($@"
    </div>

    <!-- Footer -->
    <div style='text-align:center;padding:20px 0 0;'>
      <p style='color:#94a3b8;font-size:11px;margin:0;'>
        Sent via Industrial ML Platform · Client Data Collector · {sentAt}
      </p>
    </div>

  </div>
</body>
</html>");

        return sb.ToString();
    }
}

public class SendResponsesRequest
{
    public string To        { get; set; } = "";
    public string FormTitle { get; set; } = "";
    public List<ResponseRow> Responses { get; set; } = new();
}

public class ResponseRow
{
    public string Question { get; set; } = "";
    public string Answer   { get; set; } = "";
}
