export const idlFactory = ({ IDL }) => {
  const PollOption = IDL.Record({
    'id' : IDL.Nat,
    'votes' : IDL.Nat,
    'text' : IDL.Text,
  });
  const Poll = IDL.Record({
    'id' : IDL.Nat,
    'created' : IDL.Int,
    'creator' : IDL.Principal,
    'expiresAt' : IDL.Int,
    'question' : IDL.Text,
    'isPrivate' : IDL.Bool,
    'isMultipleChoice' : IDL.Bool,
    'options' : IDL.Vec(PollOption),
  });
  const Comment = IDL.Record({
    'id' : IDL.Nat,
    'text' : IDL.Text,
    'author' : IDL.Principal,
    'timestamp' : IDL.Int,
    'pollId' : IDL.Nat,
  });
  const Vote = IDL.Record({
    'voter' : IDL.Principal,
    'optionIds' : IDL.Vec(IDL.Nat),
  });
  return IDL.Service({
    'addComment' : IDL.Func([IDL.Nat, IDL.Text], [IDL.Nat], []),
    'createPoll' : IDL.Func(
        [IDL.Text, IDL.Vec(IDL.Text), IDL.Bool, IDL.Bool, IDL.Int],
        [IDL.Nat],
        [],
      ),
    'getAllPolls' : IDL.Func([], [IDL.Vec(Poll)], ['query']),
    'getComments' : IDL.Func([IDL.Nat], [IDL.Opt(IDL.Vec(Comment))], ['query']),
    'getPoll' : IDL.Func([IDL.Nat], [IDL.Opt(Poll)], ['query']),
    'getVotes' : IDL.Func([IDL.Nat], [IDL.Opt(IDL.Vec(Vote))], ['query']),
    'vote' : IDL.Func([IDL.Nat, IDL.Vec(IDL.Nat)], [IDL.Bool], []),
  });
};
export const init = ({ IDL }) => { return []; };
