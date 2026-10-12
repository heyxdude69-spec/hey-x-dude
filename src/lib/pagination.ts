export function getPageNumbers(currentPage: number, totalPages: number) {
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 5));
  return Array.from({ length: Math.min(6, totalPages) }, (_, index) => start + index);
}
