import textwrap
from typing import Union

from cardpicker.mpcorder import (
    CardbackImage,
    CardImage,
    CardImageCollection,
    Faces,
    MPCOrder,
    ReqTypes,
)


class TestMPCOrder:
    # region helpers

    @classmethod
    def assert_card_images_identical(
        cls, a: Union[CardImage, CardbackImage], b: Union[CardImage, CardbackImage]
    ) -> None:
        assert a.query == b.query and a.slots == b.slots and a.req_type == b.req_type

    @classmethod
    def assert_card_image_collections_identical(cls, a: CardImageCollection, b: CardImageCollection) -> None:
        assert a.keys() == b.keys()
        for key in a.keys():
            cls.assert_card_images_identical(a[key], b[key])

    @classmethod
    def assert_mpc_orders_identical(cls, a: MPCOrder, b: MPCOrder) -> None:
        cls.assert_card_image_collections_identical(a[Faces.FRONT], b[Faces.FRONT])
        cls.assert_card_image_collections_identical(a[Faces.BACK], b[Faces.BACK])
        cls.assert_card_images_identical(a.cardback, b.cardback)
        assert a.cardstock == b.cardstock
        assert a.foil == b.foil

    # endregion

    # region tests

    def test_populate_from_text(self, dfc_pairs):
        order = MPCOrder()
        order.from_text(
            textwrap.dedent(
                """
                12 island
                2 Huntmaster of the Fells
                2x t:goblin
                """
            )
        )
        back = CardbackImage()
        back.add_slots({(x, "") for x in range(16)} - {(12, ""), (13, "")})
        self.assert_mpc_orders_identical(
            order,
            MPCOrder(
                fronts=CardImageCollection(
                    {
                        "island": CardImage(query="island", req_type=ReqTypes.CARD, slots={(x, "") for x in range(12)}),
                        "huntmaster of fells": CardImage(
                            query="huntmaster of fells", req_type=ReqTypes.CARD, slots={(12, ""), (13, "")}
                        ),
                        "goblin": CardImage(query="goblin", req_type=ReqTypes.TOKEN, slots={(14, ""), (15, "")}),
                    }
                ),
                backs=CardImageCollection(
                    {
                        "ravager of fells": CardImage(
                            query="ravager of fells", req_type=ReqTypes.CARD, slots={(12, ""), (13, "")}
                        )
                    }
                ),
                cardback=back,
            ),
        )

    def test_populate_from_text_offset(self, dfc_pairs):
        order = MPCOrder()
        order.from_text(
            textwrap.dedent(
                """
                12 island
                2 Huntmaster of the Fells
                2x t:goblin
                """
            ),
            offset=3,
        )
        back = CardbackImage()
        back.add_slots({(x + 3, "") for x in range(16)} - {(15, ""), (16, "")})
        self.assert_mpc_orders_identical(
            order,
            MPCOrder(
                fronts=CardImageCollection(
                    {
                        "island": CardImage(
                            query="island", req_type=ReqTypes.CARD, slots={(x + 3, "") for x in range(12)}
                        ),
                        "huntmaster of fells": CardImage(
                            query="huntmaster of fells", req_type=ReqTypes.CARD, slots={(15, ""), (16, "")}
                        ),
                        "goblin": CardImage(query="goblin", req_type=ReqTypes.TOKEN, slots={(17, ""), (18, "")}),
                    }
                ),
                backs=CardImageCollection(
                    {
                        "ravager of fells": CardImage(
                            query="ravager of fells", req_type=ReqTypes.CARD, slots={(15, ""), (16, "")}
                        )
                    }
                ),
                cardback=back,
            ),
        )

    def test_populate_from_text_twice(self, dfc_pairs):
        order = MPCOrder()
        order.from_text(
            textwrap.dedent(
                """
                12 island
                """
            )
        )
        order.from_text(
            textwrap.dedent(
                """
                2 Huntmaster of the Fells
                2x t:goblin
                """
            ),
            offset=12,
        )
        back = CardbackImage()
        back.add_slots({(x, "") for x in range(16)} - {(12, ""), (13, "")})
        self.assert_mpc_orders_identical(
            order,
            MPCOrder(
                fronts=CardImageCollection(
                    {
                        "island": CardImage(query="island", req_type=ReqTypes.CARD, slots={(x, "") for x in range(12)}),
                        "huntmaster of fells": CardImage(
                            query="huntmaster of fells", req_type=ReqTypes.CARD, slots={(12, ""), (13, "")}
                        ),
                        "goblin": CardImage(query="goblin", req_type=ReqTypes.TOKEN, slots={(14, ""), (15, "")}),
                    }
                ),
                backs=CardImageCollection(
                    {
                        "ravager of fells": CardImage(
                            query="ravager of fells", req_type=ReqTypes.CARD, slots={(12, ""), (13, "")}
                        )
                    }
                ),
                cardback=back,
            ),
        )

    # endregion
