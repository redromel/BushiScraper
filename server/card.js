export default class Card{
    constructor(card_id, name, img, alt, quantity){
        this.card_id = card_id;
        this.name = name;
        this.alt = alt;
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
