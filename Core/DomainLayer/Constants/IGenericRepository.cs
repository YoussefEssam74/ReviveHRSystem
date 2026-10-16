using System.Threading;
using DomainLayer.Models;

namespace DomainLayer.Contracts
{
    public interface IGenaricRepository<TEntity, TKey> where TEntity : BaseEntity<TKey>
    {
        Task AddAsync(TEntity entity, CancellationToken cancellationToken = default);
        void Update(TEntity entity);
        void Remove(TEntity entity);
        Task<TEntity?> GetByIdAsync(TKey id, CancellationToken cancellationToken = default);
        Task<IEnumerable<TEntity>> GetAllAsync(CancellationToken cancellationToken = default);
        
        Task<TEntity?> GetByIdAsync(ISpecification<TEntity, TKey> specification, CancellationToken cancellationToken = default);
        Task<IEnumerable<TEntity>> GetAllAsync(ISpecification<TEntity, TKey> specification, CancellationToken cancellationToken = default);
        Task<int> CountAsync(ISpecification<TEntity, TKey> specification, CancellationToken cancellationToken = default);
    }
}
