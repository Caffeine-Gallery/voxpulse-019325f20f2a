import Bool "mo:base/Bool";
import Int "mo:base/Int";

import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Time "mo:base/Time";
import Option "mo:base/Option";
import Buffer "mo:base/Buffer";

actor {
    type PollOption = {
        id: Nat;
        text: Text;
        votes: Nat;
    };

    type Poll = {
        id: Nat;
        creator: Principal;
        question: Text;
        options: [PollOption];
        isPrivate: Bool;
        isMultipleChoice: Bool;
        expiresAt: Int;
        created: Int;
    };

    type Comment = {
        id: Nat;
        pollId: Nat;
        author: Principal;
        text: Text;
        timestamp: Int;
    };

    type Vote = {
        voter: Principal;
        optionIds: [Nat];
    };

    type UserProfile = {
        principal: Principal;
        createdPolls: [Nat];
        participatedPolls: [Nat];
    };

    private stable var nextPollId: Nat = 0;
    private stable var nextCommentId: Nat = 0;

    private var polls = HashMap.HashMap<Nat, Poll>(0, Nat.equal, Hash.hash);
    private var votes = HashMap.HashMap<Nat, [Vote]>(0, Nat.equal, Hash.hash);
    private var comments = HashMap.HashMap<Nat, [Comment]>(0, Nat.equal, Hash.hash);
    private var userProfiles = HashMap.HashMap<Principal, UserProfile>(0, Principal.equal, Principal.hash);

    private stable var pollEntries: [(Nat, Poll)] = [];
    private stable var voteEntries: [(Nat, [Vote])] = [];
    private stable var commentEntries: [(Nat, [Comment])] = [];
    private stable var userProfileEntries: [(Principal, UserProfile)] = [];

    system func preupgrade() {
        pollEntries := Iter.toArray(polls.entries());
        voteEntries := Iter.toArray(votes.entries());
        commentEntries := Iter.toArray(comments.entries());
        userProfileEntries := Iter.toArray(userProfiles.entries());
    };

    system func postupgrade() {
        polls := HashMap.fromIter<Nat, Poll>(pollEntries.vals(), 0, Nat.equal, Hash.hash);
        votes := HashMap.fromIter<Nat, [Vote]>(voteEntries.vals(), 0, Nat.equal, Hash.hash);
        comments := HashMap.fromIter<Nat, [Comment]>(commentEntries.vals(), 0, Nat.equal, Hash.hash);
        userProfiles := HashMap.fromIter<Principal, UserProfile>(userProfileEntries.vals(), 0, Principal.equal, Principal.hash);
    };

    public shared(msg) func createPoll(question: Text, options: [Text], isPrivate: Bool, isMultipleChoice: Bool, expiresAt: Int) : async Nat {
        let pollId = nextPollId;
        nextPollId += 1;

        let pollOptions = Array.mapEntries<Text, PollOption>(options, func(text, i) {
            {
                id = i;
                text = text;
                votes = 0;
            }
        });

        let newPoll: Poll = {
            id = pollId;
            creator = msg.caller;
            question = question;
            options = pollOptions;
            isPrivate = isPrivate;
            isMultipleChoice = isMultipleChoice;
            expiresAt = expiresAt;
            created = Time.now();
        };

        polls.put(pollId, newPoll);
        votes.put(pollId, []);

        switch (userProfiles.get(msg.caller)) {
            case (null) {
                userProfiles.put(msg.caller, {
                    principal = msg.caller;
                    createdPolls = [pollId];
                    participatedPolls = [];
                });
            };
            case (?profile) {
                userProfiles.put(msg.caller, {
                    principal = profile.principal;
                    createdPolls = Array.append(profile.createdPolls, [pollId]);
                    participatedPolls = profile.participatedPolls;
                });
            };
        };

        pollId
    };

    public query func getUserPolls(user: Principal) : async ?UserProfile {
        userProfiles.get(user)
    };

    public query func getPoll(pollId: Nat) : async ?Poll {
        polls.get(pollId)
    };

    public query func getAllPolls() : async [Poll] {
        Iter.toArray(polls.vals())
    };

    public shared(msg) func vote(pollId: Nat, optionIds: [Nat]) : async Bool {
        switch (polls.get(pollId)) {
            case (null) { return false; };
            case (?poll) {
                if (Time.now() > poll.expiresAt) { return false; };

                let newVote: Vote = {
                    voter = msg.caller;
                    optionIds = optionIds;
                };

                let currentVotes = Option.get(votes.get(pollId), []);
                let updatedVotes = Array.append(currentVotes, [newVote]);
                votes.put(pollId, updatedVotes);

                switch (userProfiles.get(msg.caller)) {
                    case (null) {
                        userProfiles.put(msg.caller, {
                            principal = msg.caller;
                            createdPolls = [];
                            participatedPolls = [pollId];
                        });
                    };
                    case (?profile) {
                        if (not Array.exists<Nat>(profile.participatedPolls, func(id) { id == pollId })) {
                            userProfiles.put(msg.caller, {
                                principal = profile.principal;
                                createdPolls = profile.createdPolls;
                                participatedPolls = Array.append(profile.participatedPolls, [pollId]);
                            });
                        };
                    };
                };

                true
            };
        }
    };

    public query func getVotes(pollId: Nat) : async ?[Vote] {
        votes.get(pollId)
    };

    public shared(msg) func addComment(pollId: Nat, text: Text) : async Nat {
        let commentId = nextCommentId;
        nextCommentId += 1;

        let newComment: Comment = {
            id = commentId;
            pollId = pollId;
            author = msg.caller;
            text = text;
            timestamp = Time.now();
        };

        let currentComments = Option.get(comments.get(pollId), []);
        let updatedComments = Array.append(currentComments, [newComment]);
        comments.put(pollId, updatedComments);
        commentId
    };

    public query func getComments(pollId: Nat) : async ?[Comment] {
        comments.get(pollId)
    };
}
