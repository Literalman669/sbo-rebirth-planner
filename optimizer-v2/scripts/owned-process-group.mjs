function signalOwnedGroup(pid, name, signal) {
  try {
    signal(-pid, name);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ESRCH') return false;
    throw error;
  }
  return true;
}

export async function terminateOwnedProcessGroup({ pid, signal, waitForExit }) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('Owned process group requires a positive PID');
  if (!signalOwnedGroup(pid, 'SIGTERM', signal)) return;
  if (await waitForExit()) return;
  if (!signalOwnedGroup(pid, 'SIGKILL', signal)) return;
  if (!(await waitForExit())) throw new Error('Owned local SpacetimeDB process group did not exit');
}

export async function stopOwnedLinuxServer({ server, signal, waitForGroupAbsence }) {
  await terminateOwnedProcessGroup({
    pid: server.pid,
    signal,
    waitForExit: waitForGroupAbsence,
  });
  if (!(await waitForGroupAbsence())) throw new Error('Owned local SpacetimeDB process group did not exit');
  server.stdout?.destroy();
  server.stderr?.destroy();
  server.unref();
}
