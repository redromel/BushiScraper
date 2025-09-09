const replaceCardInfo = (oldCard, newCard) => {
  oldCard.card_name = newCard.card_name;
  oldCard.card_id = newCard.card_id;
  oldCard.card_set = newCard.card_set;
  oldCard.lang = newCard.lang;
  oldCard.card_class = newCard.card_class;
  oldCard.card_type = newCard.card_type;
  oldCard.card_trait = newCard.card_trait;
  oldCard.alternate_ids = newCard.alternate_ids;
};

export default class Card {
  constructor({
    card_name,
    card_id,
    card_set,
    lang = "",
    card_class = "",
    card_type = [],
    card_trait = [],
    alternate_ids = [],
    quantity,
  }) {
    this.card_name = card_name;
    this.card_id = card_id;
    this.card_set = card_set;
    this.lang = lang;
    this.card_class = card_class;
    this.card_type = card_type;
    this.card_trait = card_trait;
    this.alternate_ids = alternate_ids;
    this.quantity = quantity;
  }

  getCardInfo() {
    return {
      card_name: this.card_name,
      card_id: this.card_id,
      card_set: this.card_set,
      lang: this.lang,
      card_class: this.card_class,
      card_type: this.card_type,
      card_trait: this.card_trait,
      alternate_ids: this.alternate_ids,
      quantity: this.quantity,
    };
  }
  setOtherLangCard(cardIdMap) {

    for (const altId of this.alternate_ids) {
      const altCard = cardIdMap.get(altId);
      if (altCard.lang !== this.lang) {
        replaceCardInfo(this, altCard);
        return;
      }
    }
    return null;
  }
  getCardInfoFromId(cardIdMap) {
    const card = cardIdMap.get(this.card_id);
    if (!card) {
      // console.log(`${card.card_name} ID# ${this.card_id} not found`);
      return;
    }
    replaceCardInfo(this, card);
    return;
  }
  /**
   * Prints card specifically for the SVE sim
   * @returns {String} compatible string for the SVE sim to read
   */
  printCard() {
    //Strips (Evolved) from card name to be compatible with the SVE sim
    const cleanName = this.card_name.replace(/\s*\(Evolved\)\s*$/i, "");
    return `${this.quantity} ${cleanName}`;
  }
}
