using DomainLayer.Contracts;
using DomainLayer.Models;
using Microsoft.EntityFrameworkCore;

namespace Presistence
{
    static class SpecificationEvaluator
    {
        public static IQueryable<TEntity> CreateQuery<TEntity, TKey>(IQueryable<TEntity> inputQuery, ISpecification<TEntity, TKey> specification) where TEntity : BaseEntity<TKey>
        {
            var query = inputQuery;

            if (specification.AsNoTracking)
            {
                query = query.AsNoTracking();
            }

            if (specification.Criteria is not null)
            {
                query = query.Where(specification.Criteria);
            }

            if (specification.OrderBy is not null)
            {
                var ordered = query.OrderBy(specification.OrderBy);
                query = specification.ThenByDescending is not null
                    ? ordered.ThenByDescending(specification.ThenByDescending)
                    : ordered;
            }
            else if (specification.OrderByDescending != null)
            {
                var ordered = query.OrderByDescending(specification.OrderByDescending);
                query = specification.ThenByDescending is not null
                    ? ordered.ThenByDescending(specification.ThenByDescending)
                    : ordered;
            }

            if (specification.IncludeExpressions is not null && specification.IncludeExpressions.Count > 0)
            {
                query = specification.IncludeExpressions.Aggregate(query, (current, include) => current.Include(include));
            }

            if (specification.IsPaginated)
            {
                query = query.Skip(specification.Skip).Take(specification.Take);
            }

            return query;
        }
    }
}
