using AutoMapper;

namespace Service.Mapping;

/// <summary>
/// ResolutionContext.Items is only populated when Map is invoked with an options
/// action; the plain Map overloads throw on Context.Items. TryGetItems returns
/// false there, so these extensions make context-item lookups safe on every path.
/// </summary>
internal static class MappingContextExtensions
{
    public static TItem? TryGetItem<TItem>(this ResolutionContext ctx, string key) where TItem : struct
    {
        if (ctx.TryGetItems(out var items) && items.TryGetValue(key, out var value) && value is TItem typed)
        {
            return typed;
        }

        return null;
    }

    public static string? TryGetStringItem(this ResolutionContext ctx, string key)
    {
        if (ctx.TryGetItems(out var items) && items.TryGetValue(key, out var value) && value is string text)
        {
            return text;
        }

        return null;
    }
}
