# ...
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"
cd ./frontend 
npm test
npm run build




