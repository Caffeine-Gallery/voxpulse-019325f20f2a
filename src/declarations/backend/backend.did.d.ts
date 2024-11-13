import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Comment {
  'id' : bigint,
  'text' : string,
  'author' : Principal,
  'timestamp' : bigint,
  'pollId' : bigint,
}
export interface Poll {
  'id' : bigint,
  'created' : bigint,
  'creator' : Principal,
  'expiresAt' : bigint,
  'question' : string,
  'accessCode' : [] | [string],
  'isPrivate' : boolean,
  'isMultipleChoice' : boolean,
  'options' : Array<PollOption>,
}
export interface PollOption { 'id' : bigint, 'votes' : bigint, 'text' : string }
export interface UserProfile {
  'principal' : Principal,
  'createdPolls' : Array<bigint>,
  'participatedPolls' : Array<bigint>,
}
export interface Vote { 'voter' : Principal, 'optionIds' : Array<bigint> }
export interface _SERVICE {
  'addComment' : ActorMethod<[bigint, string], bigint>,
  'createPoll' : ActorMethod<
    [string, Array<string>, boolean, [] | [string], boolean, bigint],
    bigint
  >,
  'getComments' : ActorMethod<[bigint], [] | [Array<Comment>]>,
  'getPoll' : ActorMethod<[bigint], [] | [Poll]>,
  'getPublicPolls' : ActorMethod<[], Array<Poll>>,
  'getUserPolls' : ActorMethod<[Principal], [] | [UserProfile]>,
  'getVotes' : ActorMethod<[bigint], [] | [Array<Vote>]>,
  'verifyPollAccess' : ActorMethod<[bigint, string], boolean>,
  'vote' : ActorMethod<[bigint, Array<bigint>, [] | [string]], boolean>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
