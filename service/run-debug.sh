#!/bin/bash
#from https://stackoverflow.com/questions/17577093/how-do-i-get-the-absolute-directory-of-a-file-in-bash
OSCAR_SERVICE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OSCAR_EXEC_DIR="${OSCAR_SERVICE_DIR}"
source "${OSCAR_SERVICE_DIR}/cfg/debug.cfg"
source "${OSCAR_SERVICE_DIR}/lib/run.sh"
