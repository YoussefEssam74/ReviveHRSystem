namespace DomainLayer.Models.RequestModule.Enums
{
    /// <summary>
    /// Identifies the stage of a two-phase approval process.
    /// BranchManager (first-level operational recommendation), HR (final authorization authority).
    /// </summary>
    public enum ApprovalStage
    {
        BranchManager = 1,
        HR = 2
    }
}
