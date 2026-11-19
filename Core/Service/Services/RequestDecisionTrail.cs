using DomainLayer.Models.RequestModule;

namespace Service.Services;

/// <summary>
/// Read helpers over a request's decision trail, shared by the mapping profile
/// (desk inbox) and the HR portal service so both surfaces stamp a row with the
/// same moment.
/// </summary>
public static class RequestDecisionTrail
{
    /// <summary>
    /// The request's most recent decision, whatever its stage — the transition that
    /// produced the current status. The automatic advance markers are included: they
    /// record when a request moved past a desk nobody staffed.
    /// </summary>
    public static RequestDecision? Latest(EmployeeRequest? request) =>
        request?.Decisions.OrderBy(d => d.DecidedAt).LastOrDefault();
}
