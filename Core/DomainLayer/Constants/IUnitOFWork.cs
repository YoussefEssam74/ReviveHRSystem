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

        /// <summary>
        /// Takes a PostgreSQL transaction-scoped advisory lock. Must be called inside
        /// <see cref="ExecuteInTransactionAsync"/>; released when that transaction ends.
        /// </summary>
        Task AcquireTransactionLockAsync(int key, CancellationToken cancellationToken = default);
    }
}
