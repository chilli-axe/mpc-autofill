import { rest } from "msw";

export const handlers = [
  rest.post("/2/sources", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          0: {
            pk: 0,
            key: "source_1",
            name: "Source 1",
            identifier: "id_1",
            source_type: "gdrive",
            external_link: undefined,
            description: "",
          },
          1: {
            pk: 1,
            key: "source_2",
            name: "Source 2",
            identifier: "id_2",
            source_type: "gdrive",
            external_link: undefined,
            description: "",
          },
          2: {
            pk: 2,
            key: "source_3",
            name: "Source 3",
            identifier: "id_3",
            source_type: "gdrive",
            external_link: undefined,
            description: "",
          },
        },
      })
    );
  }),
];
