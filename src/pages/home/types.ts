export type Appointment = {
  ID: string;
  "Дата и время": string;
  "Дата n8n": string; // dd.MM.yyyy
  "Доктор ID": string;
  "Пациент ID": string;
  Статус: "Оплачено" | "Ожидаем" | "Со скидкой" | string;
  Ночь: boolean | string;
  Стоимость: number;
  "Итого, сом"?: number;
  "Наличные"?: number;
  "Безналичные"?: number;
  "Долг"?: number;
};
