using Microsoft.AspNetCore.SignalR;
public class SensorHub : Hub {
    public async Task JoinAsset(string assetId) =>
        await Groups.AddToGroupAsync(
            Context.ConnectionId, $"asset_{assetId}");
}