namespace DomainLayer.Exceptions;

/// <summary>
/// The employee was recognized and their attendance day is already closed (checked
/// in and checked out). Derived from <see cref="BadRequestException"/> so HTTP
/// callers of the events endpoint still see a 400; the face pipeline catches this
/// type specifically and reports a silent "already complete" scan outcome instead
/// of surfacing a rejection card on the kiosk.
/// </summary>
public sealed class AttendanceAlreadyCompleteException : BadRequestException
{
    public AttendanceAlreadyCompleteException(string message)
        : base(message)
    {
    }
}
