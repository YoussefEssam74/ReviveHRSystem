
using DomainLayer.Contracts;
using Microsoft.EntityFrameworkCore;
using Presistence.Data;
using Presistence.Repository;

namespace ReviveHRSystem.Web
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.

            builder.Services.AddControllers();

            // Configure DbContext with PostgreSQL
            // cspell:disable-next-line
            builder.Services.AddDbContext<ReviveHrDbContext>(options =>
                options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

            // Register UnitOfWork and Generic Repository
            builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

            // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

            var app = builder.Build();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();

          //  app.UseAuthorization();


            app.MapControllers();

            app.Run();
        }
    }
}
