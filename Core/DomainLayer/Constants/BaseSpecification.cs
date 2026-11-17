using System.Linq.Expressions;
using DomainLayer.Models;

namespace DomainLayer.Contracts
{
    /// <summary>
    /// Convenience base for specification implementations — subclasses set
    /// <see cref="Criteria"/> and call <see cref="AddInclude"/> in their constructor.
    /// </summary>
    public abstract class BaseSpecification<TEntity, TKey> : ISpecification<TEntity, TKey>
        where TEntity : BaseEntity<TKey>
    {
        public Expression<Func<TEntity, bool>>? Criteria { get; protected set; }
        public List<Expression<Func<TEntity, object>>> IncludeExpressions { get; } = new();
        public Expression<Func<TEntity, object>>? OrderBy { get; protected set; }
        public Expression<Func<TEntity, object>>? OrderByDescending { get; protected set; }
        public Expression<Func<TEntity, object>>? ThenByDescending { get; protected set; }
        public int Skip { get; protected set; }
        public int Take { get; protected set; }
        public bool IsPaginated { get; protected set; }

        /// <summary>
        /// Reads are materialized without ChangeTracker tracking unless a specification
        /// opts in, so list/aggregate queries do not pay the tracking + GC cost for
        /// rows they only read. Specifications whose rows are mutated and persisted
        /// through the same fetched graph (tracked-save flows) call
        /// <see cref="ApplyTracking"/> in their constructor.
        /// </summary>
        public bool AsNoTracking { get; protected set; } = true;

        protected void AddInclude(Expression<Func<TEntity, object>> includeExpression) =>
            IncludeExpressions.Add(includeExpression);

        protected void ApplyPaging(int skip, int take)
        {
            Skip = skip;
            Take = take;
            IsPaginated = true;
        }

        public void ApplyNoTracking()
        {
            AsNoTracking = true;
        }

        public void ApplyTracking()
        {
            AsNoTracking = false;
        }
    }
}
