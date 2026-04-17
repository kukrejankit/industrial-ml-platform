using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Net.Mail;
using System.Text;

[ApiController]
[Route("api/email")]
public class EmailController : ControllerBase
{
    private readonly IConfiguration _cfg;

    public EmailController(IConfiguration cfg) { _cfg = cfg; }

    [HttpPost("send-responses")]
    public async Task<IActionResult> SendResponses([FromBody] SendResponsesRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.To))
            return BadRequest("Recipient email is required.");

        var host     = _cfg["Smtp:Host"];
        var port     = int.TryParse(_cfg["Smtp:Port"], out var p) ? p : 587;
        var username = _cfg["Smtp:Username"];
        var password = _cfg["Smtp:Password"];
        var from     = _cfg["Smtp:From"] ?? username;

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(username))
            return StatusCode(503, "Email service is not configured.");

        var html = BuildEmailHtml(req);

        using var client = new SmtpClient(host, port)
        {
            EnableSsl   = true,
            Credentials = new NetworkCredential(username, password)
        };

        var message = new MailMessage(from!, req.To)
        {
            Subject    = $"Form Responses: {req.FormTitle}",
            Body       = html,
            IsBodyHtml = true
        };

        await client.SendMailAsync(message);
        return Ok();
    }

    private static string BuildEmailHtml(SendResponsesRequest req)
    {
        var title = WebUtility.HtmlEncode(req.FormTitle);
        var sb    = new StringBuilder();

        sb.Append($@"<html>
<body style='font-family:Arial,sans-serif;color:#1e293b;padding:24px;'>
  <h2 style='color:#0f766e;margin:0 0 4px;'>Form Responses</h2>
  <p style='color:#64748b;margin:0 0 24px;font-size:14px;'>{title}</p>
  <table style='border-collapse:collapse;width:100%;max-width:640px;'>
    <thead>
      <tr style='background:#0f766e;color:white;'>
        <th style='padding:10px 16px;text-align:left;font-size:13px;'>Question</th>
        <th style='padding:10px 16px;text-align:left;font-size:13px;'>Answer</th>
      </tr>
    </thead>
    <tbody>");

        for (int i = 0; i < req.Responses.Count; i++)
        {
            var row = req.Responses[i];
            var bg  = i % 2 == 0 ? "#f8fafc" : "#ffffff";
            sb.Append($@"
      <tr style='background:{bg};'>
        <td style='padding:10px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;font-size:13px;width:40%;'>{WebUtility.HtmlEncode(row.Question)}</td>
        <td style='padding:10px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;'>{WebUtility.HtmlEncode(row.Answer)}</td>
      </tr>");
        }

        sb.Append(@"
    </tbody>
  </table>
  <p style='color:#94a3b8;font-size:11px;margin-top:24px;'>Sent via Industrial ML Platform · Client Data Collector</p>
</body>
</html>");

        return sb.ToString();
    }
}

public class SendResponsesRequest
{
    public string To           { get; set; } = "";
    public string FormTitle    { get; set; } = "";
    public List<ResponseRow> Responses { get; set; } = new();
}

public class ResponseRow
{
    public string Question { get; set; } = "";
    public string Answer   { get; set; } = "";
}
