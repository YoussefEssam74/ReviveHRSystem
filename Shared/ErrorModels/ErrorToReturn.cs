namespace Shared.ErrorModels;

public class ErrorToReturn
{
    public int StatusCode { get; set; }
    
    public string ErrorMessage { get; set; } = default!;
    public List<string> Errors { get; set; } = new();
}
