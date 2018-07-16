cd "${OSCAR_EXEC_DIR}"
umask u=rwx,g=rwx,o=
if [ "${USE_GDB}" = "n" ]; then
	sg www-data -c "${OSCAR_PATH} -c ${OSCAR_CFG}"
else
	sg www-data -c "cgdb --args ${OSCAR_PATH} -c ${OSCAR_CFG}"
fi
