export default class Card{
    constructor(card_id, card_name, img, alt_ids, quantity){
        this.card_id = card_id;
        this.name = card_name;
        this.alt = alt_ids;
        this.img = img;
        this.quantity = quantity;
    }

    getCardInfo(){
        return {
            card_id: this.card_id,
            name: this.name,
            img: this.img,
            alt: this.alt,
            quantity: this.quantity
        }
    }
}
