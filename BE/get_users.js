(async () => {
  try {
    const token = process.argv[2];
    if (!token) {
      console.error('Usage: node get_users.js <ACCESS_TOKEN>');
      process.exit(1);
    }
    const res = await fetch('http://localhost:3000/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
