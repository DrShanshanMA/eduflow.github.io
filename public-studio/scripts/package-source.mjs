import {execFileSync} from 'node:child_process';
execFileSync('zip',['-qr','../project-studio-public-source.zip','.','-x','node_modules/*','dist/*','.git/*','.env','.env.local','.local/*','supabase/functions/.env','supabase/.temp/*']);
console.log('Source package created outside the project folder.');
