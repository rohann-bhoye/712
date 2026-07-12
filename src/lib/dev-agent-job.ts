import { connectToDatabase } from './mongodb';
import { ObjectId } from 'mongodb';

export type JobState = 
  | 'queued' 
  | 'analyzing' 
  | 'planning' 
  | 'editing' 
  | 'building' 
  | 'testing' 
  | 'reviewing' 
  | 'pushing' 
  | 'completed' 
  | 'failed';

export interface JobEvent {
  stage: JobState;
  message: string;
  timestamp: Date;
}

export interface AgentJob {
  _id?: ObjectId;
  userId: string;
  workspaceId: string;
  prompt: string;
  state: JobState;
  events: JobEvent[];
  diffs?: string;
  commitMessage?: string;
  buildStatus?: 'success' | 'failed';
  testStatus?: 'success' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export async function createAgentJob(userId: string, workspaceId: string, prompt: string): Promise<string> {
  const { db } = await connectToDatabase();
  
  const newJob: AgentJob = {
    userId,
    workspaceId,
    prompt,
    state: 'queued',
    events: [
      { stage: 'queued', message: 'Agent job queued and initialized.', timestamp: new Date() }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const result = await db.collection('dev_agent_jobs').insertOne(newJob);
  return result.insertedId.toString();
}

export async function transitionJobState(jobId: string, state: JobState, message: string, extraFields: Partial<AgentJob> = {}) {
  const { db } = await connectToDatabase();
  
  const event: JobEvent = {
    stage: state,
    message,
    timestamp: new Date()
  };
  
  await db.collection('dev_agent_jobs').updateOne(
    { _id: new ObjectId(jobId) },
    {
      $set: {
        state,
        updatedAt: new Date(),
        ...extraFields
      },
      $push: {
        events: event
      }
    } as any
  );
}

export async function getJobById(jobId: string): Promise<AgentJob | null> {
  const { db } = await connectToDatabase();
  const job = await db.collection('dev_agent_jobs').findOne({ _id: new ObjectId(jobId) });
  return job as AgentJob | null;
}
