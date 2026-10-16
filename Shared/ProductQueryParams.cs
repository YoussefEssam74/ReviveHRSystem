namespace Shared
{
    public class ProductQueryParams
    {
        private const int MaxPageSize = 10;
        private const int DefaultPageSize = 5;
        public int? BrandId { get; set; }
        public int? TypeId { get; set; }
        public ProductSortingOptions? sort { get; set; }
        public string? Search { get; set; }
        public int PageNumber    { get; set; } = 1;
        private int pageSize { get; set; } = DefaultPageSize;

        public int PageSize
        {
            get { return pageSize; }
            set { pageSize = value > MaxPageSize ? MaxPageSize : value; }
        }
    }
}
