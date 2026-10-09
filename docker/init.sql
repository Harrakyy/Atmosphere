-- Create atmosphere_test database if not exists
SELECT 'CREATE DATABASE atmosphere_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'atmosphere_test')\gexec

GRANT ALL PRIVILEGES ON DATABASE atmosphere_test TO atm;
