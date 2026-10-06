using System.Linq.Expressions;
using DomainLayer.Models;

namespace DomainLayer.Contracts
{
    public interface ISpecification<TEntity, TKey> where TEntity : BaseEntity<TKey>
    {
        public Expression<Func<TEntity, bool>>? Criteria { get; }
        List<Expression<Func<TEntity, object>>> IncludeExpressions { get; }
        Expression<Func<TEntity, object>>? OrderBy { get; }
        Expression<Func<TEntity, object>>? OrderByDescending { get; }
        public int Skip { get; }
        public int Take { get; }
        public bool IsPaginated { get; }
    }
}
