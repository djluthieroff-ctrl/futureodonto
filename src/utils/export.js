/**
 * Utility to export JSON data to CSV and download it.
 * @param {Array} data - Array of objects to export.
 * @param {string} filename - Name of the file to be downloaded.
 */
export const exportToCSV = (data, filename = 'export.csv') => {
    if (!data || !data.length) return;

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => {
        return Object.values(obj).map(val => {
            const strValue = String(val);
            // Escape double quotes and wrap in quotes if contains comma
            if (strValue.includes(',') || strValue.includes('"')) {
                return `"${strValue.replace(/"/g, '""')}"`;
            }
            return strValue;
        }).join(',');
    });

    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
