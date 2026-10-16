using System;
using System.Threading;
using DomainLayer.Models;

namespace DomainLayer.Contracts
{
    public interface IUnitOfWork
    {
        IGenaricRepository<TEntity, TKey> GetRepository<TEntity, TKey>() where TEntity : BaseEntity<TKey>;
        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
        Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default);
    }
}
