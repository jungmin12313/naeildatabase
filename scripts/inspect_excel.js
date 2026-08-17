const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../docs/내일 현장답사.xlsx');
try {
  const workbook = xlsx.readFile(filePath);
  console.log('Sheet Names:', workbook.SheetNames);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, range: 0 });
    if (data.length > 0) {
      console.log('Headers:', data[0]);
      if (data.length > 1) {
        console.log('First Data Row:', data[1]);
      }
    } else {
      console.log('Empty sheet');
    }
  });
} catch (error) {
  console.error('Error reading excel file:', error);
}
