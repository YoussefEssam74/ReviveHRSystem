using System.Linq.Expressions;
using DomainLayer.Models;

namespace DomainLayer.Contracts
{
    public interface ISpecification<TEntity, TKey> where TEntity : BaseEntity<TKey>
    {
        public Expression<Func<TEntity, bool>>? Criteria { get; }
        List<Expression<Func<TEntity, object>>> IncludeExpressions { get; }

        /// <summary>
        /// Dotted navigation paths for eager loading, e.g. "Subscriptions.Plan". Needed for
        /// second-level includes (ThenInclude), which cannot be expressed as a typed
        /// expression on the non-generic IncludeExpressions list.
        /// </summary>
        List<string> IncludePaths { get; }

        Expression<Func<TEntity, object>>? OrderBy { get; }
        Expression<Func<TEntity, object>>? OrderByDescending { get; }
        Expression<Func<TEntity, object>>? ThenByDescending { get; }
        public int Skip { get; }
        public int Take { get; }
        public bool IsPaginated { get; }
        public bool AsNoTracking { get; }

        /// <summary>
        /// Bypasses the global query filters (soft-delete in particular). Needed by checks
        /// that must see archived rows — e.g. a role name is reserved by its archived role.
        /// </summary>
        public bool IgnoreQueryFilters { get; }
    }
}
