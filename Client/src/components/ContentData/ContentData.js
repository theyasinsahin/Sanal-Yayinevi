import React, { useState, useEffect } from "react";
import './ContentData.css';

const ContentData = () => {
    const [countOfContent, setCountOfContent] = useState(0);
    const [countOfAuthor, setCountOfAuthor] = useState(0);
    const [countOfPublished, setCountOfPublished] = useState(0);

    useEffect(() => {
        // Function to animate the counts
        const animateCount = (setCount, targetValue) => {
            let current = 0;
            const increment = Math.ceil(targetValue / 100);

            const interval = setInterval(() => {
                current += increment;
                if (current >= targetValue) {
                    current = targetValue;
                    clearInterval(interval);
                }
                setCount(current);
            }, 20);
        };

        let count1 = 755;
        let count2 = 303;
        let count3 = 82;
        
        count1 = count1<10 ? count1 : count1-(count1%10);
        count2 = count2<10 ? count2 : count2-(count2%10);
        count3 = count3<10 ? count3 : count3-(count3%10);
        
        animateCount(setCountOfContent, count1);
        animateCount(setCountOfAuthor, count2);
        animateCount(setCountOfPublished, count3);
    }, []);

    return (
        <div className="content-data">
            <div>
                <h4>Toplam İçerik Sayısı</h4> 
                <h1 className="count">{countOfContent < 10 ? countOfContent : '+'+countOfContent}</h1>
            </div>
            <div>   
                <h4>Toplam Yazar Sayısı</h4>
                <h1 className="count">{countOfAuthor < 10 ? countOfAuthor : '+'+countOfAuthor}</h1>
            </div>
            <div>
                <h4>Toplam Basılan Kitap Sayısı</h4>
                <h1 className="count">{countOfPublished < 10 ? countOfPublished : '+'+countOfPublished}</h1>
            </div>
        </div>
    );
};

export default ContentData;
