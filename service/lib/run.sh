cd "${OSCAR_EXEC_DIR}"
umask u=rwx,g=rwx,o=
sg www-data -c "cgdb --args ${OSCAR_PATH} -c ${OSCAR_CFG}"
