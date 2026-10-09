using DomainLayer.Contracts;
using DomainLayer.Models;
using Microsoft.EntityFrameworkCore;
using Presistence.Data;

namespace Presistence.Repository
{
    public class GenericRepository<TEntity, TKey>(ReviveHrDbContext _dbContext) : IGenaricRepository<TEntity, TKey> where TEntity : BaseEntity<TKey>
    {

        public async Task<IEnumerable<TEntity>> GetAllAsync(CancellationToken cancellationToken = default) => await _dbContext.Set<TEntity>().ToListAsync(cancellationToken);
        public async Task<TEntity?> GetByIdAsync(TKey id, CancellationToken cancellationToken = default) => await _dbContext.Set<TEntity>().FindAsync(new object?[] { id }, cancellationToken);
        public async Task AddAsync(TEntity entity, CancellationToken cancellationToken = default) => await _dbContext.Set<TEntity>().AddAsync(entity, cancellationToken);

        public void Update(TEntity entity) => _dbContext.Set<TEntity>().Update(entity);
        public void Remove(TEntity entity) => _dbContext.Set<TEntity>().Remove(entity);

        #region With Specification

        public async Task<IEnumerable<TEntity>> GetAllAsync(ISpecification<TEntity, TKey> specification, CancellationToken cancellationToken = default)
        {
            return await SpecificationEvaluator.CreateQuery(_dbContext.Set<TEntity>(), specification).ToListAsync(cancellationToken);
        }
        public async Task<TEntity?> GetByIdAsync(ISpecification<TEntity, TKey> specification, CancellationToken cancellationToken = default)
        {
            return await SpecificationEvaluator.CreateQuery(_dbContext.Set<TEntity>(), specification).FirstOrDefaultAsync(cancellationToken);
        }

        public async Task<int> CountAsync(ISpecification<TEntity, TKey> specification, CancellationToken cancellationToken = default)
        => await SpecificationEvaluator.CreateQuery(_dbContext.Set<TEntity>(), specification).CountAsync(cancellationToken);

        #endregion
    }
}
