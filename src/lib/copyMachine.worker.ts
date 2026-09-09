import { runCopyMachineJob, type CopyMachineJobRequest } from './copyMachineJob'

addEventListener('message', (event: MessageEvent<CopyMachineJobRequest>) => {
  postMessage(runCopyMachineJob(event.data))
})
