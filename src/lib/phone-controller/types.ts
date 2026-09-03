export type PhoneControllerSystem = "gba" | "nes";

export type SerializedSessionDescription = {
    type: "offer" | "answer";
    sdp: string;
};

export type PhoneControlMessage =
    | {
        type: "press" | "release";
        button: string;
    }
    | {
        type: "release-all";
    }
    | {
        type: "heartbeat";
    };
