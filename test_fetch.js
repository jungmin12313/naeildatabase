fetch('https://naeildatabase.vercel.app')
  .then(r => r.text())
  .then(t => {
    const match = t.match(/dapi\.kakao\.com[^\"\']+/);
    console.log('Script URL:', match ? match[0] : 'NOT FOUND');
  })
  .catch(console.error);
