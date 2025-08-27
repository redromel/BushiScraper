export default class Card{
    constructor(code, name, img, alt, quantity){
        this.code = code;
        this.name = name;
        this.alt = alt;
        this.img = img;
        this.quantity = quantity;
    }

    getCardInfo(){
        return {
            code: this.code,
            name: this.name,
            img: this.img,
            alt: this.alt,
            quantity: this.quantity
        }
    }
}
