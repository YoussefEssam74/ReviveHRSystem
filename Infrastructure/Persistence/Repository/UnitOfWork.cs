using System.Threading;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Presistence.Data;

namespace Presistence.Repository
{
    public class UnitOfWork(ReviveHrDbContext _dbContext) : IUnitOfWork
    {
        private readonly Dictionary<string, object> _repositories = new();
        public IGenaricRepository<TEntity, TKey> GetRepository<TEntity, TKey>() where TEntity : BaseEntity<TKey>
        {
            var typeName = typeof(TEntity).Name;
            if (_repositories.TryGetValue(typeName,out object? value))
                return (IGenaricRepository<TEntity, TKey>)value;
            else
            {
                var Repo = new GenericRepository<TEntity, TKey>(_dbContext);
                _repositories[typeName] = Repo;
                return Repo;
            }
        }

        public async Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default)
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                await operation();
                await transaction.CommitAsync(cancellationToken);
            }
            catch
            {
                await transaction.RollbackAsync(CancellationToken.None);
                throw;
            }
        }

        public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                return await _dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // Unique-constraint race (e.g. two simultaneous check-ins for the same
                // employee+date) — surfaced as a bad request, not a server error.
                throw new BadRequestException("The record already exists (concurrent update).", innerException: ex);
            }
        }
    }
}
