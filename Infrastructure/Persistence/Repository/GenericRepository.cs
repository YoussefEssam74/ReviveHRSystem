using DomainLayer.Contracts;
using DomainLayer.Models;
using Microsoft.EntityFrameworkCore;
using Presistence.Data;

namespace Presistence.Repository
{
    public class GenericRepository<TEntity, TKey>(ReviveHrDbContext _dbContext) : IGenaricRepository<TEntity, TKey> where TEntity : BaseEntity<TKey>
    {

        public async Task<IEnumerable<TEntity>> GetAllAsync() => await _dbContext.Set<TEntity>().ToListAsync();
        public async Task<TEntity?> GetByIdAsync(TKey id) => await _dbContext.Set<TEntity>().FindAsync(id);
        public async Task AddAsync(TEntity entity) => await _dbContext.Set<TEntity>().AddAsync(entity);

        public void Update(TEntity entity) => _dbContext.Set<TEntity>().Update(entity);
        public void Remove(TEntity entity) => _dbContext.Set<TEntity>().Remove(entity);

        #region With Specification

        public async Task<IEnumerable<TEntity>> GetAllAsync(ISpecification<TEntity, TKey> specification)
        {
            return await SpecificationEvaluator.CreateQuery(_dbContext.Set<TEntity>(), specification).ToListAsync();
        }
        public async Task<TEntity?> GetByIdAsync(ISpecification<TEntity, TKey> specification)
        {
            return await SpecificationEvaluator.CreateQuery(_dbContext.Set<TEntity>(), specification).FirstOrDefaultAsync();
        }

        public async Task<int> CountAsync(ISpecification<TEntity, TKey> specification)
        => await SpecificationEvaluator.CreateQuery(_dbContext.Set<TEntity>(), specification).CountAsync();

        #endregion
    }
}
