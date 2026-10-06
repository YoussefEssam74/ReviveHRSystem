using DomainLayer.Contracts;
using DomainLayer.Models;
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
        public async Task<int> SaveChangesAsync() => await _dbContext.SaveChangesAsync();
    }
}
