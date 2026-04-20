import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';

export default function PrivacyPolicyPage(): JSX.Element {
  return (
    <SitePublicPageShell>
      <SiteFrameWithTopNav>
        <section className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <article className="rounded-[32px] border border-white bg-[#ffffffb3] p-6 shadow-[inset_0px_0px_70px_#ffffffb2] backdrop-blur-[10px] sm:p-8 lg:p-10">
            <h1 className="typo-h3 mb-3 bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent]">
              Политика конфиденциальности и обработки персональных данных
            </h1>
            <p className="mb-6 font-nunito text-sm font-semibold text-[#5e6567] sm:text-base">
              Платформа: https://app.moinovichistimir.ru/
            </p>

            <div className="space-y-4 font-nunito text-sm leading-relaxed text-[#2b3335] sm:text-base">
              <p>
                ООО «МОЙ НОВЫЙ ЧИСТЫЙ МИР» (ОГРН: 1137451018066, ИНН: 7451362856), адрес:
                454003, Челябинская область, г. Челябинск, ул. Университетская Набережная, дом
                66А, строение 2, офис 203, является оператором персональных данных и обрабатывает
                их в соответствии с Федеральным законом N 152-ФЗ.
              </p>

              <div>
                <p className="font-bold">1. Категории обрабатываемых данных</p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>IP-адрес, cookies, данные браузера и устройства.</li>
                  <li>Email, VK ID, хешированный пароль.</li>
                  <li>История транзакций, данные о пополнениях, реферальная статистика.</li>
                  <li>Логи входов и действий.</li>
                  <li>Фамилия, имя, отчество, название компании.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold">2. Цели обработки</p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Предоставление доступа к платформе и исполнение договорных отношений.</li>
                  <li>Идентификация пользователя и обеспечение безопасности сервиса.</li>
                  <li>Коммуникации через формы обратной связи и поддержку.</li>
                  <li>Обработка платежей и операционных действий в личном кабинете.</li>
                  <li>Анализ и улучшение работы платформы, статистический анализ.</li>
                  <li>Маркетинговые и информационные рассылки до отзыва согласия.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold">3. Правовые основания</p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Согласие субъекта персональных данных (ст. 6 ч.1 152-ФЗ).</li>
                  <li>Исполнение договора, стороной которого является субъект (ст. 6 ч.5 152-ФЗ).</li>
                  <li>Исполнение обязанностей, предусмотренных законодательством РФ.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold">4. Сроки хранения</p>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Для договорных отношений: 3 года с момента последней покупки.</li>
                  <li>Для маркетинговых целей: до отзыва согласия пользователем.</li>
                  <li>Для налоговых и бухгалтерских обязательств: 5 лет.</li>
                  <li>Дополнительно в пределах сроков, требуемых законом для споров и безопасности.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold">5. Права пользователя</p>
                <p>
                  Пользователь вправе запросить доступ к данным, уточнение, блокирование,
                  удаление, ограничение обработки, а также отозвать согласие на обработку.
                </p>
              </div>

              <div>
                <p className="font-bold">6. Отзыв согласия и обращения</p>
                <p>
                  Отзыв согласия направляется по email <span className="font-semibold">info@levchukov.ru</span>{' '}
                  или по почтовому адресу оператора. Также пользователь может управлять
                  аналитическими cookies через раздел «Настройки cookies» на платформе.
                </p>
              </div>

              <p>
                Актуальная редакция Политики действует с момента публикации на платформе и может
                обновляться оператором в соответствии с требованиями законодательства.
              </p>
            </div>
          </article>
        </section>
      </SiteFrameWithTopNav>
    </SitePublicPageShell>
  );
}
