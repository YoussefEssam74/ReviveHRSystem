namespace Shared.DataTransferObject.Employee
{
    /// <summary>
    /// Simple acknowledgment body ({ message }) for lifecycle actions that change
    /// state without a richer response: transfer, position, compensation, contract,
    /// and leave-balance updates.
    /// </summary>
    public class MessageResponse
    {
        public required string Message { get; init; }
    }
}
